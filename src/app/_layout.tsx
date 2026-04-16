import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#f8f9fa' },
            headerTintColor: '#212529',
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: '#ffffff' },
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              title: 'Photo Cleanup',
              headerShown: true,
            }}
          />
          <Stack.Screen
            name="picker"
            options={{
              title: 'Select Photos',
              presentation: 'modal',
            }}
          />
          <Stack.Screen
            name="processing"
            options={{
              title: 'Analyzing...',
              headerBackVisible: false,
            }}
          />
          <Stack.Screen
            name="review"
            options={{
              title: 'Review Groups',
            }}
          />
          <Stack.Screen
            name="settings"
            options={{
              title: 'Settings',
              presentation: 'modal',
            }}
          />
        </Stack>
        <StatusBar style="auto" />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
