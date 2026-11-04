import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white border rounded-lg shadow-sm w-full max-w-sm p-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Purchase Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to continue</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
