import { render } from "preact";
import { App } from "./App";
import { aplicarTema } from "./lib/tema";
import "./lib/i18n";
import "./estilo.css";
import "./estilo-eventos.css";
import "./estilo-mala.css";
import "./estilo-looks.css";

aplicarTema();
render(<App />, document.getElementById("app")!);
