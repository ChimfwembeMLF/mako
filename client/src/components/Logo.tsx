import React from 'react'

function Logo({ className = 'h-10' }: { className?: string }) {
    return (
        <img src="/mako-logo.png" alt="Mako" className={`w-auto ${className}`} />
    )
}

export default Logo