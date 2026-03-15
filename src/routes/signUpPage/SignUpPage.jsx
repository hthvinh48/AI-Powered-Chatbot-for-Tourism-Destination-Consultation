import { SignUp } from '@clerk/react'
import './signUpPage.css'

const SignUpPage = () => {
    return (
        <div className='signUpPage'>
            <SignUp
                routing="path"
                appearance={{
                    elements: {
                        formFieldInputShowPasswordButton: {
                            color: "white",
                            backgroundColor: "#555"
                        },
                    }
                }}
                path='/sign-up'
                signInUrl='/sign-in'
                forceRedirectUrl="/dashboard"
            />
        </div>
    )
}

export default SignUpPage
