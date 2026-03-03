import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

/**
 * Returns { user, loading }
 * user  → Firebase User object (or null if signed out)
 * loading → true while the auth state is being determined on mount
 */
export const useAuthState = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);
            setLoading(false);
        });
        return unsub; // cleanup listener on unmount
    }, []);

    return { user, loading };
};
