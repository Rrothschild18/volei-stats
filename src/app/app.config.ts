import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, TitleStrategy, withComponentInputBinding } from '@angular/router';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { BR_DATE_FORMATS, BrDateAdapter } from './shared/date/br-date-adapter';

import { routes } from './app.routes';
import { AppTitleStrategy } from './shared/services/title-strategy';
import { provideData } from './core/data.providers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Banco ou cenário de exemplo: quem decide é src/environments.
    provideData(),
    {
      provide: TitleStrategy,
      useClass: AppTitleStrategy,
    },
    // O calendário do Material fala português e entende `dd/mm/aaaa` — o
    // adaptador nativo não entende, e estas telas pedem data de nascimento.
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
    { provide: DateAdapter, useClass: BrDateAdapter, deps: [MAT_DATE_LOCALE] },
    { provide: MAT_DATE_FORMATS, useValue: BR_DATE_FORMATS },
  ],
};
