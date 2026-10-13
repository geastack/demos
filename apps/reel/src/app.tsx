import { ReactiveComponent } from "@geastack/core";
import "./styles/app.css";
import { ReelScreen } from "./screens/reel";

export class App extends ReactiveComponent {
  template() {
    return (
      <div class="app">
        <ReelScreen />
      </div>
    );
  }
}
