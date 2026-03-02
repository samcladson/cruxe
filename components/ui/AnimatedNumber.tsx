import React from "react";
import { StyleSheet, TextInput, TextStyle } from "react-native";
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withTiming,
  WithTimingConfig,
} from "react-native-reanimated";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface AnimatedNumberProps {
  value: number;
  style?: TextStyle | TextStyle[];
  duration?: number;
  config?: WithTimingConfig;
}

/**
 * A specialized component that animates from 0 up to `value`
 * when it mounts or when `value` changes.
 */
export function AnimatedNumber({
  value,
  style,
  duration = 1500,
  config = {},
}: AnimatedNumberProps) {
  const animatedValue = useSharedValue(0);

  React.useEffect(() => {
    animatedValue.value = withTiming(value, { duration, ...config });
  }, [value, duration, config, animatedValue]);

  const animatedText = useDerivedValue(() => {
    return Math.round(animatedValue.value).toString();
  });

  const animatedProps = useAnimatedProps(() => {
    return {
      text: animatedText.value,
      // For cross-platform
      defaultValue: animatedText.value,
    };
  });

  return (
    <AnimatedTextInput
      underlineColorAndroid="transparent"
      editable={false}
      //@ts-ignore -> standard reanimated 3 generic casting issue with `text` prop
      animatedProps={animatedProps}
      style={[styles.textInputReset, style]}
    />
  );
}

const styles = StyleSheet.create({
  textInputReset: {
    padding: 0,
    margin: 0,
    borderWidth: 0,
    includeFontPadding: false,
    color: "#fff",
  },
});
