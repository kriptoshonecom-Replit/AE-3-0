declare module "react-simple-maps" {
  import type React from "react";

  interface ComposableMapProps {
    projection?: string;
    projectionConfig?: Record<string, unknown>;
    width?: number;
    height?: number;
    style?: React.CSSProperties;
    children?: React.ReactNode;
  }
  export const ComposableMap: React.FC<ComposableMapProps>;

  export interface GeographyFeature {
    rsmKey: string;
    properties: Record<string, unknown>;
    [key: string]: unknown;
  }

  interface GeographiesRenderProps {
    geographies: GeographyFeature[];
  }
  interface GeographiesProps {
    geography: string | object;
    children: (props: GeographiesRenderProps) => React.ReactNode;
  }
  export const Geographies: React.FC<GeographiesProps>;

  interface GeographyStyle {
    default?: React.CSSProperties & { outline?: string; cursor?: string };
    hover?: React.CSSProperties & { outline?: string; cursor?: string; fill?: string };
    pressed?: React.CSSProperties & { outline?: string };
  }
  interface GeographyProps {
    geography: GeographyFeature;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: GeographyStyle;
    onMouseEnter?: (event: React.MouseEvent<SVGPathElement>) => void;
    onMouseMove?: (event: React.MouseEvent<SVGPathElement>) => void;
    onMouseLeave?: (event: React.MouseEvent<SVGPathElement>) => void;
    onClick?: (event: React.MouseEvent<SVGPathElement>) => void;
  }
  export const Geography: React.FC<GeographyProps>;

  interface ZoomableGroupProps {
    center?: [number, number];
    zoom?: number;
    children?: React.ReactNode;
  }
  export const ZoomableGroup: React.FC<ZoomableGroupProps>;
}
