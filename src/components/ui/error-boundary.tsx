"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch and display React errors.
 * Wrap this around pages or components that might fail.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });

    // Log to error reporting service (e.g., Sentry) in production
    if (process.env.NODE_ENV === "production") {
      // TODO: Add Sentry or similar error tracking
      // Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
    }
  }

  private handleRefresh = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/dashboard";
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[400px] items-center justify-center p-6">
          <Card className="max-w-md border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20">
            <CardHeader className="text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
              <CardTitle className="text-xl text-red-700 dark:text-red-400">
                Something went wrong
              </CardTitle>
              <CardDescription className="text-red-600 dark:text-red-500">
                We encountered an unexpected error.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {process.env.NODE_ENV === "development" && this.state.error && (
                <details className="rounded-lg bg-white p-4 text-xs dark:bg-zinc-900">
                  <summary className="cursor-pointer font-medium text-red-700 dark:text-red-400">
                    Error Details
                  </summary>
                  <pre className="mt-2 overflow-auto text-red-600 dark:text-red-500">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
              <div className="flex gap-3">
                <Button
                  onClick={this.handleRefresh}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reload Page
                </Button>
                <Button
                  variant="outline"
                  onClick={this.handleGoHome}
                  className="flex-1"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Go Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
