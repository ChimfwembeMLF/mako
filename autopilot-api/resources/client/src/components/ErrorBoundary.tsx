import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Props {
  children: ReactNode;
  /** Custom fallback UI. If omitted, the default error card is shown. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Label for the section (used in error messages) */
  label?: string;
}

interface State {
  error: Error | null;
}

/**
 * ErrorBoundary — catches render errors and unhandled promise rejections
 * from AI generation calls, API timeouts, and unexpected state.
 *
 * Wrap individual panels (not the entire app) for granular recovery:
 *   <ErrorBoundary label="Content Engine">
 *     <ContentPanel />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return <>{this.props.fallback(error, this.reset)}</>;

    const isTimeout  = error.message.includes('timeout') || error.message.includes('ETIMEDOUT');
    const isAiError  = error.message.includes('AI_ERROR') || error.message.includes('RATE_LIMIT');
    const isCredits  = error.message.includes('CREDITS_EXHAUSTED');

    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {isCredits  ? 'AI Credits Exhausted' :
             isTimeout  ? 'Request Timed Out' :
             isAiError  ? 'AI Generation Failed' :
             `Error in ${this.props.label ?? 'this section'}`}
          </AlertTitle>
          <AlertDescription className="mt-1 text-sm">
            {isCredits ? (
              <>You've used all AI generations for this billing period. Upgrade your plan to continue.</>
            ) : isTimeout ? (
              <>The request took too long. Check your connection and try again.</>
            ) : isAiError ? (
              <>The AI service returned an error. This is usually temporary — please retry.</>
            ) : (
              <>{error.message}</>
            )}
          </AlertDescription>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={this.reset} className="gap-1">
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </Button>
            {isCredits && (
              <Button size="sm" onClick={() => window.location.href = '/billing'}>
                Upgrade Plan
              </Button>
            )}
          </div>
        </Alert>
      </div>
    );
  }
}

/**
 * withErrorBoundary — HOC variant for quick wrapping of page components.
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  label?: string,
) {
  return function BoundedComponent(props: P) {
    return (
      <ErrorBoundary label={label}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}
