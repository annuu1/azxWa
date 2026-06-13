import { login } from "@/features/auth/actions/auth-actions";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" action={async (formData) => {
          "use server";
          await login(formData);
        }}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <Input
                name="email"
                type="email"
                required
                placeholder="Email address"
                className="mb-2"
              />
            </div>
            <div>
              <Input
                name="password"
                type="password"
                required
                placeholder="Password"
              />
            </div>
          </div>

          <div>
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </div>
        </form>
        <div className="text-center">
          <a href="/register" className="text-sm text-blue-600 hover:text-blue-500">
            Don't have an account? Register
          </a>
        </div>
      </div>
    </div>
  );
}
