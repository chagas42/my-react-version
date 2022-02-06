import React from 'react';

import {
  View,
  Image,
  ImageBackground,
  Text,
} from 'react-native';

import LayerImage from '../../assets/subtract.png';
import ProfileImage from '../../assets/picture.jpeg';

import { styles } from './styles';

export const Header = () => {
  return (
  <View style={styles.header}>
    <View style={styles.greetingArea}>
      <View style={styles.nameArea}>
        <Text style={styles.greetingText}>Olá,</Text>
        <Text 
          style={[
            styles.greetingText,
            { fontWeight: 'bold', marginLeft: 7 }
          ]}
        >
          Júnior Chagas
        </Text>
      </View>
    
      <Text
        style={[
          styles.greetingText,
          {fontSize: 16, marginTop: 5}
        ]}
      >
        Bem Vindo! 😄
      </Text>
    </View>

    <ImageBackground
      source={LayerImage}
      style={styles.imgArea}
      resizeMode="stretch"
    >
    <View style={[styles.pictureArea]}>
        <Image
          style={styles.picture}
          source={ProfileImage}
        />
    </View>
    </ImageBackground>

</View>
  );
}