import { useEffect, useMemo, type ReactNode } from 'react';
import {
  createIntl,
  createIntlCache,
  RawIntlProvider,
  type IntlShape,
} from 'react-intl';

import { sanitizeBrandText } from './brand-i18n';

const intlCache = createIntlCache();

interface Props {
  locale: string;
  messages: Record<string, string>;
  children: ReactNode;
  /** Called with the live intl instance (used to expose `window.ferdium.intl`). */
  onIntlChange?: (intl: IntlShape) => void;
}

type FormatMessageArgs = Parameters<IntlShape['formatMessage']>;

/**
 * Drop-in replacement for react-intl's `IntlProvider` that routes every
 * formatted message through the brand sanitizer.
 *
 * The pre-sanitized locale dictionaries (see `./translations`) already cover all
 * translated values, but react-intl falls back to a component's `defaultMessage`
 * when a locale is missing a key. That fallback never passes through the
 * dictionaries, so we close the gap here in a single place.
 */
export default function BrandIntlProvider({ locale, messages, children, onIntlChange }: Props) {
  const intl = useMemo(() => {
    const base = createIntl({ locale, defaultLocale: 'en-US', messages }, intlCache);

    const formatMessage = base.formatMessage.bind(base);
    base.formatMessage = ((...args: FormatMessageArgs) =>
      sanitizeBrandText(formatMessage(...args))) as IntlShape['formatMessage'];

    return base;
  }, [locale, messages]);

  useEffect(() => {
    onIntlChange?.(intl);
  }, [intl, onIntlChange]);

  return <RawIntlProvider value={intl}>{children}</RawIntlProvider>;
}
