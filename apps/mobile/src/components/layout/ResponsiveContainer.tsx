import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { useDeviceType } from '@/hooks/useDeviceType';

interface ResponsiveContainerProps extends ViewProps {
    children: React.ReactNode;
    maxWidth?: number;
    centered?: boolean;
}

/**
 * ResponsiveContainer ensures UI elements do not stretch uncomfortably wide on tablets.
 * It constrains the maximum width and optionally centers the content.
 */
export function ResponsiveContainer({ 
    children, 
    maxWidth = 768, 
    centered = true,
    style,
    ...props 
}: ResponsiveContainerProps) {
    const { isTablet } = useDeviceType();

    return (
        <View 
            style={[
                isTablet && centered && styles.centered,
                style
            ]} 
            {...props}
        >
            <View style={[isTablet && { maxWidth, width: '100%' }]}>
                {children}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    centered: {
        alignItems: 'center',
        width: '100%',
    }
});
