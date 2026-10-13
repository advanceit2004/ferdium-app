import AboutApp from '../../components/settings/aboutApp/AboutAppDashboard';
import ErrorBoundary from '../../components/util/ErrorBoundary';

const SupportScreen = () => {
  return (
    <ErrorBoundary>
      <AboutApp />
    </ErrorBoundary>
  );
};

export default SupportScreen;
