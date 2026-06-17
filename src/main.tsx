import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Brand typography
import "@fontsource-variable/geist/index.css";
import "@fontsource-variable/fraunces/index.css";

createRoot(document.getElementById("root")!).render(<App />);
