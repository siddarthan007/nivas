import { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, CameraView } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useHaptics } from '@/hooks/useHaptics';
import { Text, Heading, Subheading } from '@/components/ui/Typography';
import { X, QrCode } from 'lucide-react-native';
import Toast from 'react-native-toast-message';

export default function ScanScreen() {
  const { width } = useWindowDimensions();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const router = useRouter();
  const { success, error, light } = useHaptics();

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };
    getCameraPermissions();
  }, []);

  const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    
    // Parse the QR data. Expecting formats like "table:1" or "room:101". Fallback to table if just a number.
    let qrType = 'table';
    let id = data.replace('nivas://table/', '').replace('nivas://room/', '');

    if (data.includes(':')) {
      const parts = data.split(':');
      qrType = parts[0].toLowerCase();
      id = parts[1];
    }

    if (id && !isNaN(Number(id))) {
      success();
      if (qrType === 'room') {
        Toast.show({ type: 'success', text1: 'Room Identified', text2: `Opening Dashboard for Room ${id}` });
        router.replace({
          pathname: '/orders/room/[id]',
          params: { id }
        });
      } else {
        Toast.show({ type: 'success', text1: 'Table Identified', text2: `Opening POS for Table ${id}` });
        router.replace({
          pathname: '/orders/pos/[tableId]',
          params: { tableId: id }
        });
      }
    } else {
      error();
      Toast.show({ type: 'error', text1: 'Invalid QR Code', text2: 'Please scan a valid Nivas QR code.' });
      setTimeout(() => setScanned(false), 2000);
    }
  };

  if (hasPermission === null) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center">
        <Text className="text-white">Requesting camera permission...</Text>
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center p-6">
        <Heading className="text-white text-center">No camera access</Heading>
        <Text className="text-white opacity-70 text-center mt-2">
          Please allow camera access in your device settings to scan table QR codes.
        </Text>
        <TouchableOpacity 
          className="mt-6 bg-notion-blue px-6 py-3 rounded-xl"
          onPress={() => router.back()}
        >
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Overlay UI */}
      <SafeAreaView className="flex-1">
        <View className="flex-row justify-between items-center p-4">
          <TouchableOpacity 
            onPress={() => { light(); router.back(); }}
            className="w-10 h-10 bg-black/50 rounded-full items-center justify-center"
          >
            <X size={24} color="white" />
          </TouchableOpacity>
          <View className="bg-black/50 px-4 py-2 rounded-full">
            <Text className="text-white font-bold">Scan Table QR</Text>
          </View>
          <View className="w-10 h-10" />
        </View>

        <View className="flex-1 items-center justify-center">
          {/* Scanning frame */}
          <View 
            style={{ width: width * 0.7, height: width * 0.7 }}
            className="border-2 border-white/50 rounded-3xl items-center justify-center bg-black/10"
          >
            <QrCode size={64} color="rgba(255,255,255,0.3)" />
            <Text className="text-white font-semibold mt-4 shadow-md">Align QR Code within frame</Text>
          </View>
        </View>

        <View className="p-8 items-center pb-12">
          <Subheading className="text-white text-center">
            Instantly open the POS for a table by scanning the QR code placed on it.
          </Subheading>
        </View>
      </SafeAreaView>
    </View>
  );
}
