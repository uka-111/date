import type { AuthGateway } from '../auth/authGateway';
import { AuthScreen } from '../features/session/AuthScreen';
import { PairingScreen } from '../features/session/PairingScreen';
import { VerifyEmailScreen } from '../features/session/VerifyEmailScreen';
import { CloudSetupScreen } from './CloudSetupScreen';
import { SessionProvider, useSession } from './SessionProvider';

function AppContent() {
  const session = useSession();

  switch (session.state.status) {
    case 'loading':
      return <main className="session-state"><p>正在恢复登录...</p></main>;
    case 'signed_out':
      return <AuthScreen onSignIn={session.signIn} onSignUp={session.signUp} />;
    case 'verification_required':
      return <VerifyEmailScreen email={session.state.email} onSignOut={session.signOut} />;
    case 'unpaired':
      return (
        <PairingScreen
          key={session.state.userId}
          userId={session.state.userId}
          displayName={session.state.displayName}
          onCreate={session.createCouple}
          onRedeem={session.redeemInvite}
          onContinue={session.reload}
          onSignOut={session.signOut}
        />
      );
    case 'paired':
      return (
        <CloudSetupScreen
          key={session.state.userId}
          userId={session.state.userId}
          displayName={session.state.displayName}
          memberCount={session.state.memberCount}
          onRegenerateInvite={session.regenerateInvite}
          onRefresh={session.reload}
          onSignOut={session.signOut}
        />
      );
    case 'error':
      return <main className="session-state"><p role="alert">{session.state.message}</p></main>;
  }
}

export function App({ authGateway }: { authGateway?: AuthGateway }) {
  return (
    <SessionProvider authGateway={authGateway}>
      <AppContent />
    </SessionProvider>
  );
}
