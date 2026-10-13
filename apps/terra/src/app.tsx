import { ReactiveComponent } from "@geastack/core";
import "./styles/app.css";
import { FlightScreen } from "./screens/flight";
import { flight } from "./stores/flight";

// One screen; the USER button cycles the landscapes.
export class App extends ReactiveComponent {
  template() {
    return (
      <div class="app" onKeyDown={(event) => flight.onKey(event.keyCode)}>
        <FlightScreen />
      </div>
    );
  }
}
