import socketio
import time
import random
import numpy as np
from sklearn.linear_model import LinearRegression

# ==========================================
# 1. INPUT DATA SIMULATOR (The Environment)
# ==========================================
class DataSimulator:
    def __init__(self):
        self.time_step = 0
        self.base_temp = 30.0
        self.transformer_temp = 60.0
        self.max_load = 100.0
        self.current_load = 50.0

    def generate_data(self, alpha=0.0):
        self.time_step += 1
        # Simulate Load with sine wave + random noise
        base_fluctuation = 10 * np.sin(self.time_step * 0.05)
        raw_load = 70.0 + base_fluctuation + random.uniform(-2, 2)
        
        # Apply Load Shaping (Alpha)
        self.current_load = max(0, raw_load * (1 - alpha))
        
        # Physics Model: Heat Gain
        heat_gain = (self.current_load / self.max_load) ** 2 * 0.8
        heat_loss = 0.3
        self.transformer_temp += (heat_gain - heat_loss)
        
        return {
            'time': self.time_step,
            'L_actual': self.current_load,
            'T_transformer': self.transformer_temp,
            'T_ambient': 30.0,
            'P_utility': 0.0
        }

# ==========================================
# 2. APTS ENGINE (The Patentable Logic)
# ==========================================
class APTSEngine:
    def __init__(self, critical_temp=85.0):
        self.T_critical = critical_temp
        self.Load_Cap = 0.4
        self.TPM = LinearRegression()
        self.is_tpm_trained = False
        
    def train_tpm(self, X_data, y_data):
        self.TPM.fit(X_data, y_data)
        self.is_tpm_trained = True

    def calculate_soft_load_shaping_factor(self, D):
        if not self.is_tpm_trained:
            return 0.0, D['T_transformer']
            
        features = np.array([D['L_actual'], D['T_transformer'], D['T_ambient'], D['P_utility']]).reshape(1, -1)
        T_future = self.TPM.predict(features)[0]
        
        alpha = 0.0
        if T_future >= self.T_critical:
            excess_heat = T_future - self.T_critical
            alpha = min(excess_heat * 0.05, self.Load_Cap)
            alpha = max(0.0, alpha)
            
        return alpha, T_future

# ==========================================
# 3. MAIN LOOP (Live Connection)
# ==========================================
def run_simulation():
    # Setup
    simulator = DataSimulator()
    engine = APTSEngine(critical_temp=85.0)
    
    # Socket Connection
    sio = socketio.Client()
    
    print("⏳ Attempting to connect to Local Server...")
    
    try:
        # Standard HTTP connection for localhost
        sio.connect('https://grid-lock-api.onrender.com', transports=['websocket', 'polling'])
        print("✅ Connected to Grid-Lock Server!")
    except Exception as e:
        print(f"❌ Connection Failed: {e}")
        print("💡 TIP: Make sure 'node index.js' is running in another terminal!")
        return # Stop properly if connection fails

    # Pre-Training (Synthetic Data)
    print("🧠 Training AI Model...")
    X_train, y_train = [], []
    for _ in range(500):
        D = simulator.generate_data(alpha=0.0)
        X_train.append([D['L_actual'], D['T_transformer'], D['T_ambient'], D['P_utility']])
        future_temp = D['T_transformer'] + (D['L_actual']/100)**2 * 5.0 
        y_train.append(future_temp)
    engine.train_tpm(np.array(X_train), np.array(y_train))
    
    # Real-Time Loop
    alpha_applied = 0.0
    print("\n🚀 Broadcasting Data to https://grid-lock-api.onrender.com ...")
    
    while True:
        D = simulator.generate_data(alpha_applied)
        alpha, T_predicted = engine.calculate_soft_load_shaping_factor(D)
        alpha_applied = alpha
        
        payload = {
            'timestamp': D['time'],
            'temp_actual': round(D['T_transformer'], 2),
            'temp_predicted': round(T_predicted, 2),
            'load': round(D['L_actual'], 2),
            'alpha': round(alpha_applied, 2),
            'status': "CRITICAL" if T_predicted > engine.T_critical else "OPTIMAL"
        }
        
        sio.emit('sim_update', payload)
        print(f"Sent: Temp={payload['temp_actual']} | Alpha={payload['alpha']}")
        time.sleep(1)

if __name__ == "__main__":
    run_simulation()