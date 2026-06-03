
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Sprout, 
  FlaskConical, 
  CloudSun, 
  Server, 
  Settings2, 
  RefreshCcw,
  AlertTriangle,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { ApiService } from './services/api';
import { 
  ApiResponseData, 
  ChatMessage, 
  CropPredictionRequest, 
  FertilizerRecommendationRequest 
} from './types';
import { ResponsePanel } from './components/ResponsePanel';
import { ChatPanel } from './components/ChatPanel';

const DEFAULT_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  'http://127.0.0.1:8000';

const App: React.FC = () => {
  // Global States
  const [baseUrl, setBaseUrl] = useState<string>(DEFAULT_BASE_URL);
  const [lastResponse, setLastResponse] = useState<ApiResponseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  
  // Form Categories
  const [categories, setCategories] = useState<{soil_types: string[], crop_types: string[]}>({
    soil_types: [],
    crop_types: []
  });

  // API Instance
  const api = useMemo(() => new ApiService(baseUrl), [baseUrl]);

  // Initial Load
  useEffect(() => {
    addChatMessage('system', 'Welcome to AgroArc System. How can I assist you with your farming decisions today?');
  }, []);

  const addChatMessage = (role: 'user' | 'system', content: string) => {
    setChatMessages(prev => [...prev, { role, content, timestamp: new Date() }]);
  };

  const wrapApiCall = async (call: Promise<ApiResponseData>) => {
    setLoading(true);
    try {
      const res = await call;
      setLastResponse(res);
      return res;
    } finally {
      setLoading(false);
    }
  };

  // HANDLERS
  const handleCheckServerStatus = async () => {
    const res = await wrapApiCall(api.checkStatus());
    if (res.status === 200) {
      addChatMessage('system', `Server status check: Online - ${res.data.message}`);
    } else {
      addChatMessage('system', `Server check failed: ${res.error || 'Server unreachable'}`);
    }
  };

  const handleLoadCategories = useCallback(async (notify: boolean = true) => {
    try {
      const res = await wrapApiCall(api.getFertilizerCategories());
      console.log('Categories response:', res);
      if (res.status === 200) {
        setCategories(res.data);
        if (notify) {
          addChatMessage('system', `✅ Loaded ${res.data.soil_types.length} soil types and ${res.data.crop_types.length} crop types.`);
        }
      } else if (notify) {
        addChatMessage('system', `❌ Failed to load dropdowns: ${res.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error loading categories:', err);
      if (notify) {
        addChatMessage('system', `❌ Error loading dropdowns: ${String(err)}`);
      }
    }
  }, [api]);

  useEffect(() => {
    handleLoadCategories(false);
  }, [handleLoadCategories]);

  const handlePredictCrop = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload: CropPredictionRequest = {
      N: Number(formData.get('N')),
      P: Number(formData.get('P')),
      K: Number(formData.get('K')),
      temperature: Number(formData.get('temperature')),
      humidity: Number(formData.get('humidity')),
      ph: Number(formData.get('ph')),
      rainfall: Number(formData.get('rainfall')),
    };
    const res = await wrapApiCall(api.predictCrop(payload));
    if (res.status === 200) {
      addChatMessage('system', `✅ Prediction Result: The recommended crop for these parameters is ${res.data.recommended_crop}.`);
    } else {
      addChatMessage('system', `❌ Error: ${res.error || 'Crop prediction failed'}`);
    }
  };

  const handleRecommendFertilizer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Check if categories are loaded first
    if (categories.soil_types.length === 0 || categories.crop_types.length === 0) {
      addChatMessage('system', '⚠️ Dropdowns not loaded. Please click "Load Dropdowns" button first.');
      setLastResponse({
        status: 400,
        data: null,
        requestPayload: null,
        error: 'Dropdowns not loaded. Click "Load Dropdowns" button.',
        timestamp: new Date().toLocaleTimeString()
      });
      return;
    }
    
    const formData = new FormData(e.currentTarget);
    const soilType = String(formData.get('Soil_Type')).trim();
    const cropType = String(formData.get('Crop_Type')).trim();
    
    // Validate selections
    if (!soilType || soilType === '') {
      addChatMessage('system', '❌ Please select a Soil Type from the dropdown.');
      return;
    }
    if (!cropType || cropType === '') {
      addChatMessage('system', '❌ Please select a Crop Type from the dropdown.');
      return;
    }
    
    const temp = Number(formData.get('Temperature'));
    const humidity = Number(formData.get('Humidity'));
    const moisture = Number(formData.get('Moisture'));
    const nitrogen = Number(formData.get('Nitrogen'));
    const potassium = Number(formData.get('Potassium'));
    const phosphorous = Number(formData.get('Phosphorous'));
    
    // Check for NaN values
    if (isNaN(temp) || isNaN(humidity) || isNaN(moisture) || isNaN(nitrogen) || isNaN(potassium) || isNaN(phosphorous)) {
      addChatMessage('system', '❌ All numeric fields must be valid numbers.');
      return;
    }
    
    const payload: FertilizerRecommendationRequest = {
      Temperature: temp,
      Humidity: humidity,
      Moisture: moisture,
      Soil_Type: soilType,
      Crop_Type: cropType,
      Nitrogen: nitrogen,
      Potassium: potassium,
      Phosphorous: phosphorous,
    };
    
    console.log('Sending fertilizer request:', payload);
    const res = await wrapApiCall(api.recommendFertilizer(payload));
    console.log('Fertilizer response:', res);
    
    if (res.status === 200) {
      addChatMessage('system', `✅ Fertilizer Result: Recommendation is ${res.data.recommended_fertilizer}.`);
    } else {
      addChatMessage('system', `❌ Error (${res.status}): ${res.error || 'Fertilizer recommendation failed'}`);
    }
  };

  const handleWeatherAdvisory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const city = String(formData.get('city')).trim();
    
    if (!city) {
      addChatMessage('system', '❌ Please enter a city name.');
      return;
    }
    
    const res = await wrapApiCall(api.getWeatherAdvisory(city));
    if (res.status === 200) {
      addChatMessage('system', `✅ Weather for ${res.data.city}: ${res.data.temperature}°C, Humidity: ${res.data.humidity}%. Advisory: ${res.data.advisory}`);
    } else {
      addChatMessage('system', `❌ Error: ${res.error || 'Weather advisory failed'}`);
    }
  };

  const handleChatCommand = async (cmd: string, params: Record<string, string>, rawInput: string) => {
    addChatMessage('user', rawInput);

    if (cmd === 'weather') {
      if (!params.city) {
        addChatMessage('system', 'Error: Missing "city" parameter. Usage: weather city=Islamabad');
        return;
      }
      const res = await wrapApiCall(api.getWeatherAdvisory(params.city));
      if (res.status === 200) addChatMessage('system', `Response: ${res.data.advisory}`);
      else addChatMessage('system', `API Error: ${res.error}`);
    } 
    else if (cmd === 'crop') {
      const required = ['N', 'P', 'K', 'temp', 'humidity', 'ph', 'rainfall'];
      const missing = required.filter(k => !params[k]);
      if (missing.length > 0) {
        addChatMessage('system', `Error: Missing parameters: ${missing.join(', ')}. Usage: crop N=90 P=42 K=43 temp=25 humidity=80 ph=6.5 rainfall=200`);
        return;
      }
      const payload: CropPredictionRequest = {
        N: Number(params.N),
        P: Number(params.P),
        K: Number(params.K),
        temperature: Number(params.temp),
        humidity: Number(params.humidity),
        ph: Number(params.ph),
        rainfall: Number(params.rainfall)
      };
      const res = await wrapApiCall(api.predictCrop(payload));
      if (res.status === 200) addChatMessage('system', `Response: Recommended crop is ${res.data.recommended_crop}`);
      else addChatMessage('system', `API Error: ${res.error}`);
    }
    else if (cmd === 'fertilizer') {
      const required = ['temp', 'humidity', 'moisture', 'soil', 'crop', 'N', 'P', 'K'];
      const missing = required.filter(k => !params[k]);
      if (missing.length > 0) {
        addChatMessage('system', `Error: Missing parameters: ${missing.join(', ')}`);
        return;
      }
      const payload: FertilizerRecommendationRequest = {
        Temperature: Number(params.temp),
        Humidity: Number(params.humidity),
        Moisture: Number(params.moisture),
        Soil_Type: params.soil,
        Crop_Type: params.crop,
        Nitrogen: Number(params.N),
        Potassium: Number(params.K),
        Phosphorous: Number(params.P)
      };
      const res = await wrapApiCall(api.recommendFertilizer(payload));
      if (res.status === 200) addChatMessage('system', `Response: Recommendation is ${res.data.recommended_fertilizer}`);
      else addChatMessage('system', `API Error: ${res.error}`);
    }
    else {
      const res = await wrapApiCall(api.generalChat(rawInput));
      if (res.status === 200) addChatMessage('system', `${res.data.reply}`);
      else addChatMessage('system', `AI Chat Error: ${res.error || 'Failed to get AI response'}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* HEADER */}
      <header className="bg-emerald-800 text-white shadow-lg sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white p-2 rounded-lg text-emerald-800">
            <Sprout className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">AgroArc</h1>
            <p className="text-[10px] opacity-70 uppercase font-semibold">Smart Decision Support System</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center bg-emerald-900/50 px-3 py-1.5 rounded-full text-xs font-mono border border-emerald-700">
            <Settings2 className="w-3 h-3 mr-2" />
            <input 
              type="text" 
              value={baseUrl} 
              onChange={(e) => setBaseUrl(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-white w-48 text-center"
            />
          </div>
          <button 
            onClick={handleCheckServerStatus}
            disabled={loading}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 transition-colors px-4 py-2 rounded-lg text-sm font-medium shadow-md"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
            Status
          </button>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: FORMS */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* CROP PREDICTION CARD */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-emerald-50 p-4 border-b border-emerald-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-800">
                <Sprout className="w-5 h-5" />
                <h2 className="font-bold">Crop Prediction</h2>
              </div>
            </div>
            <form onSubmit={handlePredictCrop} className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <InputField label="Nitrogen (N)" name="N" min={0} max={140} step={1} defaultValue={90} />
              <InputField label="Phosphorus (P)" name="P" min={0} max={145} step={1} defaultValue={42} />
              <InputField label="Potassium (K)" name="K" min={0} max={205} step={1} defaultValue={43} />
              <InputField label="Temperature (°C)" name="temperature" step={0.1} defaultValue={25.0} />
              <InputField label="Humidity (%)" name="humidity" min={0} max={100} step={0.1} defaultValue={82.0} />
              <InputField label="pH Level" name="ph" min={0} max={14} step={0.1} defaultValue={6.5} />
              <InputField label="Rainfall (mm)" name="rainfall" min={0} step={0.1} defaultValue={202.9} />
              <div className="sm:col-span-2 lg:col-span-3 pt-4 border-t border-slate-100 flex justify-end">
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all shadow-lg active:scale-95">
                  Predict Recommended Crop <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </section>

          {/* FERTILIZER CARD */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-amber-50 p-4 border-b border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800">
                <FlaskConical className="w-5 h-5" />
                <h2 className="font-bold">Fertilizer Recommendation</h2>
              </div>
              <button 
                type="button" 
                onClick={() => { void handleLoadCategories(); }}
                className="text-xs font-semibold flex items-center gap-1 text-amber-700 hover:text-amber-900 bg-white/50 px-2 py-1 rounded border border-amber-200"
              >
                <RefreshCcw className="w-3 h-3" /> Load Dropdowns
              </button>
            </div>
            <form onSubmit={handleRecommendFertilizer} className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <InputField label="Temp (°C)" name="Temperature" step={0.1} defaultValue={26} />
              <InputField label="Humidity (%)" name="Humidity" step={0.1} defaultValue={52} />
              <InputField label="Moisture" name="Moisture" step={0.1} defaultValue={38} />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-tight">Soil Type</label>
                <select name="Soil_Type" required className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none">
                  {categories.soil_types.length > 0 ? categories.soil_types.map(s => <option key={s} value={s}>{s}</option>) : <option value="">Load required</option>}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-tight">Crop Type</label>
                <select name="Crop_Type" required className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none">
                  {categories.crop_types.length > 0 ? categories.crop_types.map(c => <option key={c} value={c}>{c}</option>) : <option value="">Load required</option>}
                </select>
              </div>
              <InputField label="Nitrogen" name="Nitrogen" defaultValue={37} />
              <InputField label="Potassium" name="Potassium" defaultValue={0} />
              <InputField label="Phosphorous" name="Phosphorous" defaultValue={0} />
              <div className="sm:col-span-2 lg:col-span-3 pt-4 border-t border-slate-100 flex justify-end">
                <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all shadow-lg active:scale-95">
                  Get Recommendation <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </section>

          {/* WEATHER CARD */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-sky-50 p-4 border-b border-sky-100">
              <div className="flex items-center gap-2 text-sky-800">
                <CloudSun className="w-5 h-5" />
                <h2 className="font-bold">Weather Advisory</h2>
              </div>
            </div>
            <form onSubmit={handleWeatherAdvisory} className="p-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <InputField label="Enter City" name="city" type="text" placeholder="e.g. Islamabad" required />
                </div>
                <div className="flex items-end">
                  <button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white px-8 h-[42px] rounded-lg font-semibold flex items-center gap-2 transition-all shadow-lg">
                    Check Advisory
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>

        {/* RIGHT COLUMN: CHAT & RESPONSE */}
        <div className="lg:col-span-5 space-y-6">
          <ChatPanel 
            onCommand={handleChatCommand} 
            messages={chatMessages} 
            isLoading={loading}
          />
          <div className="lg:sticky lg:top-[88px]">
            <ResponsePanel response={lastResponse} />
          </div>
        </div>
      </main>

      <footer className="bg-slate-900 text-slate-500 py-6 text-center text-sm border-t border-slate-800">
        <p>© {new Date().getFullYear()} AgroArc – Final Year Project Prototype. All Rights Reserved.</p>
        <div className="flex items-center justify-center gap-4 mt-2 text-xs">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Backend Connection Ready</span>
          <span>•</span>
          <span>Powered by FastAPI & Next.js</span>
        </div>
      </footer>
    </div>
  );
};

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

const InputField: React.FC<InputFieldProps> = ({ label, ...props }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-bold text-slate-500 uppercase tracking-tight">{label}</label>
    <input 
      type={props.type || 'number'} 
      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all placeholder:text-slate-300"
      required
      {...props}
    />
  </div>
);

export default App;
