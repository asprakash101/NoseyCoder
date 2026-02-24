import { useState, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import LandingSection from "@/components/LandingSection";
import AnalyzerDemo from "@/components/AnalyzerDemo";
import Header from "@/components/Header";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [activeView, setActiveView] = useState("landing");
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const analyzeCode = useCallback(async (code, filename) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/analyze`, { code, filename });
      setAnalysisResult(res.data);
      setActiveView("results");
    } catch (err) {
      console.error("Analysis failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="app-root" data-testid="app-root">
      <BrowserRouter>
        <Header activeView={activeView} setActiveView={setActiveView} />
        <Routes>
          <Route
            path="/"
            element={
              activeView === "landing" ? (
                <LandingSection onTryDemo={() => setActiveView("demo")} />
              ) : (
                <AnalyzerDemo
                  onAnalyze={analyzeCode}
                  result={analysisResult}
                  loading={loading}
                  onBack={() => { setActiveView("landing"); setAnalysisResult(null); }}
                />
              )
            }
          />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
