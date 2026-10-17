import { inject, observer } from 'mobx-react';
import { useCallback, useEffect, type ReactNode } from 'react';
import type { IntlShape } from 'react-intl';

import BrandIntlProvider from './i18n/brand-intl';
import generatedTranslations from './i18n/translations';
import type AppStore from './stores/AppStore';
import type UserStore from './stores/UserStore';

const translations = generatedTranslations();

interface Props {
  stores: {
    app: AppStore;
    user: UserStore;
  };
  children: ReactNode;
}

const I18N = ({ stores, children }: Props) => {
  const { locale } = stores.app;

  const handleIntlChange = useCallback((intl: IntlShape) => {
    window['ferdium'].intl = intl;
  }, []);

  useEffect(() => {
    window['ferdium'].menu.rebuild();
  }, [locale]);

  return (
    <BrandIntlProvider
      key={locale}
      locale={locale}
      messages={translations[locale]}
      onIntlChange={handleIntlChange}
    >
      {children}
    </BrandIntlProvider>
  );
};

export default inject('stores')(observer(I18N));
