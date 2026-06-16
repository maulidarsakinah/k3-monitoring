import { Component } from "react";
import ErrorFallback from "./ErrorFallback.jsx";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("UI error:", error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback
          message="Ada bagian tampilan yang gagal dimuat. Coba muat ulang halaman atau kembali login jika sesi sudah habis."
          onRetry={this.reset}
        />
      );
    }

    return this.props.children;
  }
}
