import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>next_move</Text>
      <Text style={styles.subtitle}>s0-01 boot check</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#208AEF',
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    color: '#ffffff',
    fontSize: 14,
    marginTop: 8,
  },
});
