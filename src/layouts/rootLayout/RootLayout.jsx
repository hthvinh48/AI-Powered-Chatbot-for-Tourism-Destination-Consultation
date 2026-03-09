import { Link, Outlet } from 'react-router-dom'
import './rootLayout.css'
import { ClerkProvider, Show, UserButton } from '@clerk/react'

const RootLayout = () => {
    return (
        <ClerkProvider>
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