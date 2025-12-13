import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
import matplotlib.pyplot as plt
import random
from collections import deque

# ==========================================
# 1. INPUT DATA SIMULATOR (The Environment)
# ==========================================
class DataSimulator:
    """
    Simulates real-time data from the Multi-Input Sensor Array (D).
    Generates time-series data for Load, Temperatures, and Utility Stress.
    """
    def __init__(self):
        self.time_step = 0
        self.base_temp = 30.0
        self.transformer_temp = 60.0 # Starting temp
        self.max_load = 100.0 # kW Rated Capacity
        self.current_load = 50.0

    def generate_data(self, alpha=0.0):
        """
        Generates a new data vector D at the current time step.
        alpha: The Soft Load Shaping Factor applied in the previous step.
        """
        self.time_step += 1
        
        # 1. Simulate L_actual (Load): 
        # Base load fluctuates, but 'alpha' (Load Shaping) forces it down.
        # We add some random noise to make it realistic.
        base_fluctuation = 10 * np.sin(self.time_step * 0.05)
        raw_load = 70.0 + base_fluctuation + random.uniform(-2, 2)
        
        # Apply the Load Shaping Factor (alpha)
        # If alpha is 0.1, we reduce load by 10%
        self.current_load = max(0, raw_load * (1 - alpha))
        
        # 2. Simulate T_transformer (Physics Model): 
        # Temp rises if Load is high, cools if Load is low.
        # Simple physics: Heat Gain proportional to Load^2
        heat_gain = (self.current_load / self.max_load) ** 2 * 0.8
        heat_loss = 0.3 # Constant cooling
        self.transformer_temp += (heat_gain - heat_loss)
        
        # 3. Simulate T_ambient: Simple day/night cycle
        T_ambient = self.base_temp + 5 * np.sin(self.time_step * 0.1)

        # 4. Simulate P_utility (Stress Signal): Spikes occasionally
        P_utility = 0.0
        if 50 < self.time_step < 60: # Simulated grid stress event
             P_utility = 1.0 
        
        # The Multi-Input Sensor Array Data Vector D
        return {
            'time': self.time_step,
            'L_actual': self.current_load,
            'T_transformer': self.transformer_temp,
            'T_ambient': T_ambient,
            'P_utility': P_utility
        }

# ==========================================
# 2. APTS ENGINE (The Patentable Logic)
# ==========================================
class APTSEngine:
    """
    Implements the Predictive Thermal Shaping Algorithm (APTS).
    The core of the patentable technology.
    """
    def __init__(self, critical_temp=85.0):
        self.T_critical = critical_temp
        self.Load_Cap = 0.4               # Max 40% load reduction allowed
        
        # PATENTABLE COMPONENT: The Predictive Thermal Model (TPM)
        # We use LinearRegression as a placeholder for the proprietary neural network
        self.TPM = LinearRegression()
        self.is_tpm_trained = False
        
    def train_tpm(self, X_data, y_data):
        """Trains the prediction model on historical data."""
        self.TPM.fit(X_data, y_data)
        self.is_tpm_trained = True
        print("✅ TPM Model Trained Successfully.")

    def calculate_soft_load_shaping_factor(self, D: dict) -> tuple:
        """
        Calculates 'alpha' (Load Reduction Factor) based on PREDICTED future temp.
        """
        if not self.is_tpm_trained:
            return 0.0, D['T_transformer']
            
        # 1. Prepare Input Vector
        features = np.array([
            D['L_actual'], 
            D['T_transformer'], 
            D['T_ambient'], 
            D['P_utility']
        ]).reshape(1, -1)
        
        # 2. EXECUTE TPM (Prediction)
        # Predict temperature 10 steps into the future
        T_future = self.TPM.predict(features)[0]
        
        # 3. DECISION LOGIC (The "Soft Shaping")
        alpha = 0.0
        
        # If Future Temp is unsafe, start reducing load NOW (Proactive)
        if T_future >= self.T_critical:
            # Calculate how much we are over the limit
            excess_heat = T_future - self.T_critical
            
            # The harder we are hitting the limit, the higher the alpha
            alpha = excess_heat * 0.05 
            
            # Cap the reduction to ensure user comfort (max 40%)
            alpha = min(alpha, self.Load_Cap) 
            alpha = max(0.0, alpha)
            
        return alpha, T_future


# ==========================================
# 3. MAIN SIMULATION LOOP (Visualization)
# ==========================================
# ... (Keep DataSimulator and APTSEngine classes exactly as they were) ...

# ==========================================
# 3. MAIN SIMULATION LOOP (Connected)
# ==========================================
import socketio # NEW LIBRARY
import time

def run_simulation():
    # Setup Components
    simulator = DataSimulator()
    engine = APTSEngine(critical_temp=85.0)
    
    # Setup Socket Connection
    sio = socketio.Client()
    
    try:
        # Connect to your LIVE Render Backend
        sio.connect('http://localhost:3001')
        print("✅ Connected to Grid-Lock Server!")
    except Exception as e:
        print(f"❌ Connection Failed: {e}")
        return

    # A. Pre-Training Phase (Synthetic Data)
    print("Training Predictive Model...")
    X_train, y_train = [], []
    for _ in range(500):
        D = simulator.generate_data(alpha=0.0)
        X_train.append([D['L_actual'], D['T_transformer'], D['T_ambient'], D['P_utility']])
        future_temp = D['T_transformer'] + (D['L_actual']/100)**2 * 5.0 
        y_train.append(future_temp)
    engine.train_tpm(np.array(X_train), np.array(y_train))
    
    # B. Real-Time Simulation Loop
    alpha_applied = 0.0
    print("\n🚀 Broadcasting Live Data to Dashboard...")
    
    while True: # Run forever until you stop it
        # 1. Generate & Process
        D = simulator.generate_data(alpha_applied)
        alpha, T_predicted = engine.calculate_soft_load_shaping_factor(D)
        alpha_applied = alpha
        
        # 2. Create Payload
        payload = {
            'timestamp': D['time'],
            'temp_actual': round(D['T_transformer'], 2),
            'temp_predicted': round(T_predicted, 2),
            'load': round(D['L_actual'], 2),
            'alpha': round(alpha_applied, 2),
            'status': "CRITICAL" if T_predicted > engine.T_critical else "OPTIMAL"
        }
        
        # 3. Emit to Server (This sends data to the website!)
        sio.emit('sim_update', payload)
        
        print(f"Sent: Temp={payload['temp_actual']} | Alpha={payload['alpha']}")
        
        # Slow down so we can see it on the website (1 update per second)
        time.sleep(1) 

if __name__ == "__main__":
    run_simulation()



    # --- C. Visualization (The Proof) ---
    df = pd.DataFrame(history)
    
    plt.figure(figsize=(12, 6))
    
    # Plot 1: Temperatures
    plt.subplot(2, 1, 1)
    plt.plot(df['Time'], df['Temp_Actual'], label='Actual Transformer Temp', color='blue', linewidth=2)
    plt.plot(df['Time'], df['Temp_Predicted'], label='APTS Prediction (Future)', color='green', linestyle='--')
    plt.axhline(y=engine.T_critical, color='red', linestyle='-', label='Critical Limit (85°C)')
    plt.title('Patentable Logic Proof: Predictive Thermal Shaping')
    plt.ylabel('Temperature (°C)')
    plt.legend()
    plt.grid(True)
    
    # Plot 2: Load Shaping Action
    plt.subplot(2, 1, 2)
    plt.plot(df['Time'], df['Load'], label='Grid Load (kW)', color='orange')
    plt.fill_between(df['Time'], 0, df['Alpha']*100, color='purple', alpha=0.3, label='Load Shaping % (Alpha)')
    plt.ylabel('Load (kW) / Alpha (%)')
    plt.xlabel('Simulation Time Steps')
    plt.legend()
    plt.grid(True)
    
    plt.tight_layout()
    plt.show() # This opens the window!

if __name__ == "__main__":
    run_simulation()