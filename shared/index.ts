// The one module apps import from shared/. Keeping it at the tree's root makes
// the embedded build stage the whole tree (styles and fonts included) beside
// the app, since the build follows script imports only.
import "./styles/fonts.css";

export { Label } from "./components/Label";
