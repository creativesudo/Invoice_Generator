import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import InvoiceHistory from './pages/InvoiceHistory';
import InvoiceWizard from './pages/InvoiceWizard';
import Settings from './pages/Settings';
import PaymentAccounts from './pages/PaymentAccounts';
import Companies from './pages/Companies';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <nav className="navbar">
          <div className="navbar-brand">Invoice Generator</div>
          <div className="navbar-links">
            <NavLink to="/" end>History</NavLink>
            <NavLink to="/invoices/new">New Invoice</NavLink>
            <NavLink to="/companies">Companies</NavLink>
            <NavLink to="/payment-accounts">Payment A/C</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </div>
        </nav>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<InvoiceHistory />} />
            <Route path="/invoices/new" element={<InvoiceWizard />} />
            <Route path="/invoices/:id/edit" element={<InvoiceWizard />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/payment-accounts" element={<PaymentAccounts />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
