import { defineMessages, useIntl } from 'react-intl';
import { BRAND } from '../../../brand.generated';
import { FERDIUM_TRANSLATION } from '../../../config';

const messages = defineMessages({
  headline: {
    id: 'settings.aboutApp.headline',
    defaultMessage: 'About this app',
  },
  aboutIntro: {
    id: 'settings.aboutApp.aboutIntro',
    defaultMessage: 'Application information and useful links:',
  },
  about: {
    id: 'settings.aboutApp.about',
    defaultMessage:
      'This application is maintained by its contributors and is based on open-source desktop messaging technology.',
  },
});

const AboutAppDashboard = () => {
  const intl = useIntl();
  const repositoryUrl =
    BRAND.github?.owner && BRAND.github?.repo
      ? `https://github.com/${BRAND.github.owner}/${BRAND.github.repo}`
      : BRAND.website;

  return (
    <div className="settings__main">
      <div className="settings__header">
        <span className="settings__header-item">
          {intl.formatMessage(messages.headline)}
        </span>
      </div>
      <div className="settings__body">
        <div>
          <p>{intl.formatMessage(messages.aboutIntro)}</p>
          <p className="settings__message">
            {intl.formatMessage(messages.about)}
          </p>
          <ul>
            <li>
              <a href={BRAND.website} target="_blank" rel="noreferrer noopener">
                {BRAND.appName} website
              </a>
            </li>
            <li>
              <a href={repositoryUrl} target="_blank" rel="noreferrer noopener">
                Source repository
              </a>
            </li>
            {FERDIUM_TRANSLATION ? (
              <li>
                <a
                  target="_blank"
                  href={FERDIUM_TRANSLATION}
                  rel="noreferrer noopener"
                >
                  Translation project
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AboutAppDashboard;
