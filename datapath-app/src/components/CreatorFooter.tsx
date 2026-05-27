import React from 'react';
import { Mail, Link, Heart } from 'lucide-react';

interface Props {}

export const CreatorFooter: React.FC<Props> = ({}) => {

  
  return (
    <div className="creator-footer-premium" dir="ltr">
      <div className="footer-line" />
      <div className="footer-content">
        <div className="footer-info">
          <p className="developed-by">
            'Developed & Programmed by'
            <span className="creator-name"> IBRAHIM SABREY</span>
          </p>
          <div className="footer-links">
            <a href="mailto:ebrahimsabrey2001@gmail.com" className="footer-link">
              <Mail size={14} />
              <span>ebrahimsabrey2001@gmail.com</span>
            </a>
            <span className="link-divider">|</span>
            <a 
              href="https://www.linkedin.com/in/ibrahimsabrey?utm_source=share_via&utm_content=profile&utm_medium=member_ios" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="footer-link"
            >
              <Link size={14} />
              <span>LinkedIn</span>
            </a>
          </div>
        </div>
        
        <div className="footer-badge">
          <span>Kimit AI © 2026</span>
          <Heart size={12} className="heart-icon" />
        </div>
      </div>

      <style>{`
        .creator-footer-premium {
          margin-top: 40px;
          padding: 24px 0;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          position: relative;
        }

        .footer-line {
          width: 100%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
        }

        .footer-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          text-align: center;
        }

        .footer-info {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .developed-by {
          font-size: 13px;
          color: rgba(255,255,255,0.5);
          font-family: 'Plus Jakarta Sans', 'Noto Sans Arabic', system-ui, -apple-system, sans-serif;
        }

        .creator-name {
          color: #10b981;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .footer-links {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .footer-link {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: rgba(255,255,255,0.4);
          text-decoration: none;
          transition: all 0.2s ease;
          padding: 4px 8px;
          border-radius: 8px;
        }

        .footer-link:hover {
          color: #10b981;
          background: rgba(16,185,129,0.05);
          transform: translateY(-1px);
        }

        .link-divider {
          color: rgba(255,255,255,0.1);
          font-size: 10px;
        }

        .footer-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: rgba(255,255,255,0.3);
          font-weight: 500;
        }

        .heart-icon {
          color: #ef4444;
          filter: drop-shadow(0 0 5px rgba(239,68,68,0.3));
        }

        @media (max-width: 640px) {
          .footer-links {
            flex-direction: column;
            gap: 4px;
          }
          .link-divider {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};
