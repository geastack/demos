import { ReactiveComponent } from "@geastack/core";
import "./styles/app.css";
import { IntroScreen } from "./screens/intro";

export class App extends ReactiveComponent {
  template() {
    return (
      <div class="app">
        <IntroScreen />
      </div>
    );
  }
}
