import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReactNode } from 'react';

interface SafeAreaWrapperProps {
  children: ReactNode;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

export function SafeAreaWrapper({ children, edges = ['top', 'bottom'] }: SafeAreaWrapperProps) {
  const insets = useSafeAreaInsets();

  const padding = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };

  return <View style={[styles.container, padding]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
