import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NetProgressComponent } from './shared/ui';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NetProgressComponent],
  template: `
    <app-net-progress />
    <router-outlet />
  `,
})
export class App {}
