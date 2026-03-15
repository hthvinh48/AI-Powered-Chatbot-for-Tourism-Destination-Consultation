import { Link, Outlet } from 'react-router-dom'
import './rootLayout.css'
import { ClerkProvider, Show, UserButton } from '@clerk/react'

const RootLayout = () => {
    const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

    if (!PUBLISHABLE_KEY) {
        throw new Error('Add your Clerk Publishable Key to the .env file')
    }

    return (
        <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
            <div className="rootLayout">
                <header>
                    <Link to='/' className='logo'>
                        <img src="/logo.png" alt="" />
                        <span>TrAveI</span>
                    </Link>
                    <div className="user">
                        <Show when="signed-in">
                            <UserButton />
                        </Show>
                        <Show when="signed-out">
                            <div style={{ display: 'flex', gap: 12 }}>
                                <Link to="/sign-in">Đăng nhập</Link>
                                <Link to="/sign-up">Đăng ký</Link>
                            </div>
                        </Show>
                    </div>
                </header>
                <main>
                    <Outlet />
                </main>
            </div>
        </ClerkProvider>
    )
}

export default RootLayout
