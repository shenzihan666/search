import { BrowserRouter, Route, Routes } from "react-router-dom";
import Main from "./pages/Main";
import Settings from "./pages/Settings";
import { ThemeProvider } from "./components/theme-provider";

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Main />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
