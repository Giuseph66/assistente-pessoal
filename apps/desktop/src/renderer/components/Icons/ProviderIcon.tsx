import React from 'react';

export interface ProviderIconProps extends React.SVGProps<SVGSVGElement> {
    size?: number | string;
    color?: string;
}

export const ProviderIcon: React.FC<ProviderIconProps> = ({
    size = 24,
    color = 'currentColor',
    children,
    viewBox = '0 0 24 24',
    ...props
}) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox={viewBox}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            {children}
        </svg>
    );
};

