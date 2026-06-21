import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ShellComponent } from './shell/shell.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ShellComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('volei-stats');
}
