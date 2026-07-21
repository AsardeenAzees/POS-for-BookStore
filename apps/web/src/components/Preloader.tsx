type PreloaderProps = {
  fullScreen?: boolean;
  compact?: boolean;
};

export function Preloader({ fullScreen = false, compact = false }: PreloaderProps) {
  return (
    <div
      className={`preloader${fullScreen ? " preloader--fullscreen" : ""}${compact ? " preloader--compact" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="preloader__visual" aria-hidden="true">
        <div className="preloader__halo" />
        <div className="preloader__terminal">
          <div className="preloader__display">
            <span />
            <span />
            <span />
          </div>
          <div className="preloader__barcode">
            <i /><i /><i /><i /><i /><i /><i />
            <b />
          </div>
        </div>
        <div className="preloader__pulse preloader__pulse--one" />
        <div className="preloader__pulse preloader__pulse--two" />
        <div className="preloader__pulse preloader__pulse--three" />
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function PagePreloader() {
  return <Preloader />;
}
