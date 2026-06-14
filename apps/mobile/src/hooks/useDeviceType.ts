import { useWindowDimensions } from 'react-native';

export function useDeviceType() {
    const { width, height } = useWindowDimensions();
    const smallestDimension = Math.min(width, height);
    
    // Apple guidelines define regular size classes as shortest dimension >= 600
    // Material design defines tablet as >= 600dp
    const isTablet = smallestDimension >= 600;

    return {
        isTablet,
        isMobile: !isTablet,
        windowWidth: width,
        windowHeight: height
    };
}
