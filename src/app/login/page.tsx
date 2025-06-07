import LoginForm from '@/components/login-form';

/**
 * LoginPage component - User authentication page
 * Provides login form for users to authenticate with the application
 * @returns JSX element representing the login page
 */
export default function LoginPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex-grow flex flex-col items-center justify-center">
      <LoginForm />
    </div>
  );
}
