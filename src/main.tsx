import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import App from "./App";
import LandingPage from "./landing/LandingPage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<App />} />
        <Route path="/app/registry" element={<App />} />
        <Route path="/app/review" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
