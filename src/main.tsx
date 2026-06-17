import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Brand typography
import "@fontsource-variable/geist/index.css";
import "@fontsource/caveat/400.css";
import "@fontsource/caveat/500.css";
import "@fontsource/caveat/600.css";
import "@fontsource/caveat/700.css";

createRoot(document.getElementById("root")!).render(<App />);
