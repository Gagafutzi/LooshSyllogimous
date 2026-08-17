import { Component } from '@angular/core';
import { loadColorBlindnessMode } from './syllogimous/pages/settings/settings.component';
import { ThemeService } from './syllogimous/services/theme.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  title = 'Multi Layout';

  /**
   * `theme` is injected purely to construct it.
   *
   * ThemeService is `providedIn: "root"`, which makes it *lazy*, not eager —
   * Angular builds it on first injection and nothing injected it except the
   * Appearance page. Its constructor is what reads the saved theme out of
   * localStorage and writes the custom properties, so on any normal load the
   * app ran on stylesheet defaults until you happened to open Appearance, which
   * looked exactly like the theme had been forgotten. It had not; it was never
   * applied.
   */
  constructor(private theme: ThemeService) {
    loadColorBlindnessMode();
    
    const cwarn = console.warn;
    window.console.warn = (...args) => {
      if (typeof args[0] === "string" && args[0].includes("It looks like you're using the disabled attribute")) {
        return;
      }
      cwarn(...args);
    }
  }
}
