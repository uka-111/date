import type { AuthGateway } from '../auth/authGateway';
import { AuthScreen } from '../features/session/AuthScreen';
import { PairingScreen } from '../features/session/PairingScreen';
import { VerifyEmailScreen } from '../features/session/VerifyEmailScreen';
import { CloudSetupScreen } from './CloudSetupScreen';
import { BookingDataScreen } from './BookingDataScreen';
import type { DateBookingRepository } from './bookingRepository';
import { SessionProvider, useSession } from './SessionProvider';
import { createSupabaseBookingRepository } from '../storage/supabaseBookingRepository';
import { getSupabaseBrowserRuntime } from '../lib/supabaseClient';
import { BrowserRouter } from 'react-router-dom';

function AppContent({ bookingRepositoryFactory }: { bookingRepositoryFactory?: (coupleId: string, userId: string) => DateBookingRepository }) {
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
      if (session.state.memberCount === 2) {
        const repository = bookingRepositoryFactory
          ? bookingRepositoryFactory(session.state.coupleId, session.state.userId)
          : createSupabaseBookingRepository(getSupabaseBrowserRuntime().client, session.state.coupleId, session.state.userId);
        return <BookingDataScreen key={session.state.userId} repository={repository} displayName={session.state.displayName} partnerId={session.state.partnerId} onSignOut={session.signOut} />;
      }
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

export function App({ authGateway, bookingRepositoryFactory }: { authGateway?: AuthGateway; bookingRepositoryFactory?: (coupleId: string, userId: string) => DateBookingRepository }) {
  return (
    <SessionProvider authGateway={authGateway}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AppContent bookingRepositoryFactory={bookingRepositoryFactory} />
      </BrowserRouter>
    </SessionProvider>
  );
}
