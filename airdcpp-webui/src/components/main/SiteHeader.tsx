import * as React from 'react';

import { Link } from 'react-router';
import * as UI from '@/types/ui';

const SiteHeader: React.FC<UI.PropsWithChildren> = ({ children }) => (
  <div className="ui fixed inverted menu site-header">
    <div className="ui header-content">
      <Link to="/" className="item aurora-nav-brand">
        <svg className="aurora-nav-logo" width="20" height="20" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="20" stroke="#0071e3" strokeWidth="2.5" fill="none"/>
          <circle cx="24" cy="24" r="11" stroke="#0071e3" strokeWidth="1.5" fill="none" opacity="0.5"/>
          <circle cx="24" cy="24" r="4.5" fill="#0071e3"/>
        </svg>
        <span className="aurora-nav-title">AuroraYgg</span>
      </Link>
      {children}
    </div>
  </div>
);

export default SiteHeader;
