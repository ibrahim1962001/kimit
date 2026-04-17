import React from 'react';

interface Props {
  title: string;
  subtitle?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export const Card: React.FC<Props> = ({ title, subtitle, className = '', style, children }) => (
  <div className={`card ${className}`} style={style}>
    {title && (
      <div className="card-header">
        <h3 className="card-title">{title}</h3>
        {subtitle && <p className="card-sub">{subtitle}</p>}
      </div>
    )}
    {children}
  </div>
);
