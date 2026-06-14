/// <reference types="nativewind/types" />

import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    className?: string;
  }
  interface TextProps {
    className?: string;
  }
  interface ScrollViewProps {
    className?: string;
  }
  interface TextInputProps {
    className?: string;
  }
  interface PressableProps {
    className?: string;
  }
  interface TouchableOpacityProps {
    className?: string;
  }
  interface ImageProps {
    className?: string;
  }
  interface ActivityIndicatorProps {
    className?: string;
  }
  interface RefreshControlProps {
    className?: string;
  }
}

declare module 'lucide-react-native' {
  import type { FC } from 'react';
  import type { SvgProps } from 'react-native-svg';
  
  interface LucideProps extends SvgProps {
    className?: string;
  }
  
  export const ClipboardList: FC<LucideProps>;
  export const UtensilsCrossed: FC<LucideProps>;
  export const BedDouble: FC<LucideProps>;
  export const TrendingUp: FC<LucideProps>;
  export const Bell: FC<LucideProps>;
  export const ChevronRight: FC<LucideProps>;
  export const Clock: FC<LucideProps>;
  export const AlertCircle: FC<LucideProps>;
  export const CheckCircle2: FC<LucideProps>;
  export const Home: FC<LucideProps>;
  export const User: FC<LucideProps>;
  export const LogOut: FC<LucideProps>;
  export const Building: FC<LucideProps>;
  export const Mail: FC<LucideProps>;
  export const Shield: FC<LucideProps>;
  export const Hotel: FC<LucideProps>;
  export const LogIn: FC<LucideProps>;
  export const Fingerprint: FC<LucideProps>;
  export const Settings: FC<LucideProps>;
  export const Utensils: FC<LucideProps>;
  export const Clipboard: FC<LucideProps>;
}
