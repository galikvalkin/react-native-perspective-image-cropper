import React, { Component } from 'react';
import {
  NativeModules,
  PanResponder,
  Dimensions,
  Image,
  View,
  Animated,
  Platform,
} from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

const screen = Dimensions.get('screen');

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

const getWidth = (props) => (
  props.viewHeight ? props.viewHeight * props.width / props.height : Dimensions.get('window').width
);

const getHorizontalPadding = (props) => (
  (Dimensions.get('window').width - getWidth(props)) / 2
);

const TOUCHABLE_HEIGHT = 40;

const MagnifyingGlass = (props) => (
  <View
    style={[
      s({}).magnifyingGlassContainer,
      {
        width: props.blockSize,
        height: props.blockSize,
        borderRadius: props.blockSize / 2,
        borderColor: props.magnifierBorderColor,
      },
      props.containerStyle
    ]}>
    <Image
      style={[
        props.imageStyle,
        { height: props.imageHeight },
        s({}).magnifyingImageInitial,
        {
          top: props.positionTop,
          left: props.positionLeft,
        }
      ]}
      resizeMode="contain"
      source={{ uri: props.imageUri }}
    />
    <View
      style={[
        s({}).magnifyingGlassVerticalLine,
        {
          top: (props.blockSize - 25) / 2,
          left: (props.blockSize - 2) / 2,
          backgroundColor: props.magnifierBorderColor || 'black'
        }
      ]}
    />
    <View
      style={[
        s({}).magnifyingGlassHorizontalLine,
        {
          top: (props.blockSize - 2) / 2,
          left: (props.blockSize - 25) / 2,
          backgroundColor: props.magnifierBorderColor || 'black'
        }
      ]}
    />
  </View>
)

class CustomCrop extends Component {
  constructor(props) {
    super(props);
    this.state = {
      activeMarkers: {},
      viewHeight: props.viewHeight || Dimensions.get('window').width * (props.height / props.width),
      height: props.height,
      width: props.width,
      image: props.initialImage,
      moving: false,
      screenHeight: 0,
      magnifyingGlassCoords: {
        topLeft: {
          x: 0,
          y: 0,
        },
        topRight: {
          x: 0,
          y: 0,
        },
        bottomLeft: {
          x: 0,
          y: 0,
        },
        bottomRight: {
          x: 0,
          y: 0,
        },
      },
      showMagnifyingGlass: {
        topLeft: false,
        topRight: false,
        bottomLeft: false,
        bottomRight: false,
      }
    };

    this.state = {
      ...this.state,
      topLeft: new Animated.ValueXY(
        props.rectangleCoordinates
          ? this.imageCoordinatesToViewCoordinates(
            props.rectangleCoordinates.topLeft,
            true,
          )
          : { x: 100, y: 100 },
      ),
      topRight: new Animated.ValueXY(
        props.rectangleCoordinates
          ? this.imageCoordinatesToViewCoordinates(
            props.rectangleCoordinates.topRight,
            true,
          )
          : { x: getWidth(props) - 100, y: 100 },
      ),
      bottomLeft: new Animated.ValueXY(
        props.rectangleCoordinates
          ? this.imageCoordinatesToViewCoordinates(
            props.rectangleCoordinates.bottomLeft,
            true,
          )
          : { x: 100, y: this.state.viewHeight - 100 },
      ),
      bottomRight: new Animated.ValueXY(
        props.rectangleCoordinates
          ? this.imageCoordinatesToViewCoordinates(
            props.rectangleCoordinates.bottomRight,
            true,
          )
          : {
            x: getWidth(props) - 100,
            y: this.state.viewHeight - 100,
          },
      ),
    };
    const pH = getHorizontalPadding(props);
    this.state = {
      ...this.state,
      overlayPositions: `${this.state.topLeft.x._value - pH},${this.state.topLeft.y._value
        } ${this.state.topRight.x._value - pH},${this.state.topRight.y._value} ${this.state.bottomRight.x._value - pH
        },${this.state.bottomRight.y._value} ${this.state.bottomLeft.x._value - pH
        },${this.state.bottomLeft.y._value}`,
    };

    this.panResponderTopLeft = this.createPanResponser(this.state.topLeft, 'topLeft');
    this.panResponderTopRight = this.createPanResponser(
      this.state.topRight, 'topRight'
    );
    this.panResponderBottomLeft = this.createPanResponser(
      this.state.bottomLeft, 'bottomLeft'
    );
    this.panResponderBottomRight = this.createPanResponser(
      this.state.bottomRight, 'bottomRight'
    );
  }

  createPanResponser(corner, type) {
    let offset = { x: 0, y: 0 };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (event, gestureEvent) => {
        const isInRange = event.nativeEvent.locationY >= 0 && event.nativeEvent.locationY <= TOUCHABLE_HEIGHT;
        const newX = event.nativeEvent.pageX;
        const newY = event.nativeEvent.pageY;
        const horizontallyOK = (
          newX > 6
          && newX < screen.width - 6
        );
        const headerHeight = this.props.headerHeight;
        const bottomY = (Platform.select({
          ios: this.state.viewHeight,
          android: this.state.screenHeight
        }) + headerHeight);
        const topY = headerHeight;
        const topNewY = newY - (isInRange ? event.nativeEvent.locationY : 0);
        const bottomNewY = newY + (isInRange ? 40 - event.nativeEvent.locationY : 0);
        const verticallyOK = (
          topNewY >= topY
          && bottomNewY < bottomY
        );
        if (verticallyOK && horizontallyOK) {
          corner.x.setValue(gestureEvent.dx);
          corner.y.setValue(gestureEvent.dy);
          this.moveOverlayString(type, {
            x: {
              _value: gestureEvent.dx + offset.x
            },
            y: {
              _value: gestureEvent.dy + offset.y
            },
          })

        }
      },
      onPanResponderRelease: () => {
        corner.flattenOffset();
        this.updateOverlayString();
        this.setState(prevState => ({
          activeMarkers: {
            ...prevState.activeMarkers,
            [type]: false
          },
          showMagnifyingGlass: {
            ...prevState.showMagnifyingGlass,
            [type]: false
          }
        }));
      },
      onPanResponderGrant: () => {
        const initialX = corner.x._value;
        const initialY = corner.y._value;
        corner.setOffset({ x: corner.x._value, y: corner.y._value });
        offset = { x: corner.x._value, y: corner.y._value };
        corner.setValue({ x: 0, y: 0 });
        this.setState(prevState => ({
          activeMarkers: {
            ...prevState.activeMarkers,
            [type]: true
          },
          showMagnifyingGlass: {
            ...prevState.showMagnifyingGlass,
            [type]: true
          },
          magnifyingGlassCoords: {
            ...prevState.magnifyingGlassCoords,
            [type]: {
              x: initialX,
              y: initialY,
            }
          }
        }));
      },
    });
  }

  crop() {
    const coordinates = {
      topLeft: this.viewCoordinatesToImageCoordinates(this.state.topLeft),
      topRight: this.viewCoordinatesToImageCoordinates(
        this.state.topRight,
      ),
      bottomLeft: this.viewCoordinatesToImageCoordinates(
        this.state.bottomLeft,
      ),
      bottomRight: this.viewCoordinatesToImageCoordinates(
        this.state.bottomRight,
      ),
      height: this.state.height,
      width: this.state.width,
    };

    NativeModules.CustomCropManager.crop(
      coordinates,
      this.state.image,
      (err, res) => this.props.updateImage(res.image, coordinates),
    );
  }

  updateOverlayString() {
    const pH = getHorizontalPadding(this.props);
    this.setState({
      overlayPositions: `${this.state.topLeft.x._value - pH},${this.state.topLeft.y._value
        } ${this.state.topRight.x._value - pH},${this.state.topRight.y._value} ${this.state.bottomRight.x._value - pH
        },${this.state.bottomRight.y._value} ${this.state.bottomLeft.x._value - pH
        },${this.state.bottomLeft.y._value}`,
    });
  }

  moveOverlayString(key, value) {
    const state = {
      topLeft: key === 'topLeft' ? value : this.state.topLeft,
      topRight: key === 'topRight' ? value : this.state.topRight,
      bottomLeft: key === 'bottomLeft' ? value : this.state.bottomLeft,
      bottomRight: key === 'bottomRight' ? value : this.state.bottomRight,
    };
    const pH = getHorizontalPadding(this.props);
    this.setState((prevState) => ({
      overlayPositions: `${state.topLeft.x._value - pH},${state.topLeft.y._value
        } ${state.topRight.x._value - pH},${state.topRight.y._value} ${state.bottomRight.x._value - pH
        },${state.bottomRight.y._value} ${state.bottomLeft.x._value - pH
        },${state.bottomLeft.y._value}`,
      magnifyingGlassCoords: {
        ...prevState.magnifyingGlassCoords,
        [key]: {
          x: state[key].x._value,
          y: state[key].y._value,
        }
      }
    }));
  }

  imageCoordinatesToViewCoordinates(corner) {
    return {
      x: ((corner.x * getWidth(this.props)) / this.state.width) + getHorizontalPadding(this.props),
      y: (corner.y * this.state.viewHeight) / this.state.height,
    };
  }

  viewCoordinatesToImageCoordinates(corner) {
    return {
      x:
        (((corner.x._value - getHorizontalPadding(this.props)) / getWidth(this.props)) *
          this.state.width),
      y: (corner.y._value / this.state.viewHeight) * this.state.height,
    };
  }



  render() {
    const containerWidth = s(this.props).cropContainer.width;
    const imageWidth = s(this.props).image.width;

    const imagePadding = (containerWidth - imageWidth) / 2;

    const blockSize = 100;
    return (
      <View
        onLayout={event => {
          this.setState({
            screenHeight: event.nativeEvent.layout.height,
          });
        }}
        style={s(this.props).container}
      >
        <View
          style={[
            s(this.props).cropContainer,
            { height: this.state.viewHeight },

          ]}
        >
          <Image
            style={[
              s(this.props).image,
              { height: this.state.viewHeight },
            ]}
            resizeMode="contain"
            source={{ uri: this.state.image }}
          />
          <Svg
            height={this.state.viewHeight}
            width={getWidth(this.props)}
            style={s(this.props).polygon}
          >
            <AnimatedPolygon
              ref={(ref) => (this.polygon = ref)}
              fill={this.props.overlayColor || 'blue'}
              fillOpacity={this.props.overlayOpacity || 0.5}
              stroke={this.props.overlayStrokeColor || 'blue'}
              points={this.state.overlayPositions}
              strokeWidth={this.props.overlayStrokeWidth || 3}
            />
          </Svg>
          <Animated.View
            {...this.panResponderTopLeft.panHandlers}
            style={[
              this.state.topLeft.getLayout(),
              s(this.props).handler,
              { marginLeft: 0, marginTop: 0 },

            ]}
          >
            <View
              style={[
                s(this.props).handlerI,
                { left: -10, top: -10 },
                s(this.props).handlerTopLeft,
                this.state.activeMarkers.topLeft ? s(this.props).activeHandler : null,
                this.state.activeMarkers.topLeft ? { left: 5, top: 5 } : null,
              ]}
            />
            <View
              style={[
                s(this.props).handlerRound,
                { left: 50, top: 50 },
              ]}
            />
          </Animated.View>
          <Animated.View
            {...this.panResponderTopRight.panHandlers}
            style={[
              this.state.topRight.getLayout(),
              s(this.props).handler,
              { marginLeft: -40, marginTop: 0 },
            ]}
          >
            <View
              style={[
                s(this.props).handlerI,
                { left: 10, top: -10 },
                s(this.props).handlerTopLeft,
                s(this.props).handlerTopRight,
                this.state.activeMarkers.topRight ? s(this.props).activeHandler : null,
                this.state.activeMarkers.topRight ? { left: -5, top: 5 } : null,
              ]}
            />
            <View
              style={[
                s(this.props).handlerRound,
                { right: 90, top: 50 },
              ]}
            />
          </Animated.View>
          <Animated.View
            {...this.panResponderBottomLeft.panHandlers}
            style={[
              this.state.bottomLeft.getLayout(),
              s(this.props).handler,
              { marginLeft: 0, marginTop: -40 },
            ]}
          >
            <View
              style={[
                s(this.props).handlerI,
                { left: -10, top: 10 },
                s(this.props).handlerTopLeft,
                s(this.props).handlerBottomLeft,
                this.state.activeMarkers.bottomLeft ? s(this.props).activeHandler : null,
                this.state.activeMarkers.bottomLeft ? { left: 5, top: -5 } : null,
              ]}
            />
            <View
              style={[
                s(this.props).handlerRound,
                { left: 50, bottom: 90 },
              ]}
            />
          </Animated.View>
          <Animated.View
            {...this.panResponderBottomRight.panHandlers}
            style={[
              this.state.bottomRight.getLayout(),
              s(this.props).handler,
              { marginLeft: -40, marginTop: -40 },
            ]}
          >
            <View
              style={[
                s(this.props).handlerI,
                { left: 10, top: 10 },
                s(this.props).handlerTopLeft,
                s(this.props).handlerBottomRight,
                this.state.activeMarkers.bottomRight ? s(this.props).activeHandler : null,
                this.state.activeMarkers.bottomRight ? { left: -5, top: -5 } : null,
              ]}
            />
            <View
              style={[
                s(this.props).handlerRound,
                { right: 90, bottom: 90 },
              ]}
            />
          </Animated.View>
          
        </View>
        {this.state.showMagnifyingGlass.bottomLeft && (
            <MagnifyingGlass
              magnifierBorderColor={this.props.handlerColor}
              containerStyle={[
                {
                  top: 20,
                  left: 20,
                },
              ]}
              imageStyle={s(this.props).image}
              blockSize={blockSize}
              imageHeight={this.state.viewHeight}
              imageUri={this.state.image}
              positionTop={-this.state.magnifyingGlassCoords.bottomLeft.y + blockSize / 2}
              positionLeft={-this.state.magnifyingGlassCoords.bottomLeft.x + (imagePadding) + blockSize / 2}
            />
          )}
          {this.state.showMagnifyingGlass.bottomRight && (
            <MagnifyingGlass
              magnifierBorderColor={this.props.handlerColor}
              containerStyle={{
                top: 20,
                right: 20,
              }}
              imageStyle={s(this.props).image}
              blockSize={blockSize}
              imageHeight={this.state.viewHeight}
              imageUri={this.state.image}
              positionTop={-this.state.magnifyingGlassCoords.bottomRight.y + blockSize / 2}
              positionLeft={-this.state.magnifyingGlassCoords.bottomRight.x + (imagePadding) + blockSize / 2}
            />
          )}
          {this.state.showMagnifyingGlass.topLeft && (
            <MagnifyingGlass
              magnifierBorderColor={this.props.handlerColor}
              containerStyle={{
                bottom: 20,
                left: 20,
              }}
              imageStyle={s(this.props).image}
              blockSize={blockSize}
              imageHeight={this.state.viewHeight}
              imageUri={this.state.image}
              positionTop={-this.state.magnifyingGlassCoords.topLeft.y + blockSize / 2}
              positionLeft={-this.state.magnifyingGlassCoords.topLeft.x + (imagePadding) + blockSize / 2}
            />
          )}
          {this.state.showMagnifyingGlass.topRight && (
            <MagnifyingGlass
              magnifierBorderColor={this.props.handlerColor}
              containerStyle={{
                bottom: 20,
                right: 20,
              }}
              imageStyle={s(this.props).image}
              blockSize={blockSize}
              imageHeight={this.state.viewHeight}
              imageUri={this.state.image}
              positionTop={-this.state.magnifyingGlassCoords.topRight.y + blockSize / 2}
              positionLeft={-this.state.magnifyingGlassCoords.topRight.x + (imagePadding) + blockSize / 2}
            />
          )}
      </View>
    );
  }
}

const s = (props) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  magnifyingImageInitial: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  magnifyingGlassContainer: {
    backgroundColor: 'white',
    position: 'absolute',
    bottom: 100,
    right: 0,
    overflow: 'hidden',
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.43,
    shadowRadius: 9.51,
    elevation: 15,
  },
  magnifyingGlassHorizontalLine: {
    position: 'absolute',
    width: 25,
    height: 2,
    backgroundColor: 'black'
  },
  magnifyingGlassVerticalLine: {
    position: 'absolute',
    width: 2,
    height: 25,
    backgroundColor: 'black'
  },
  handlerI: {
    borderRadius: 0,
    height: 20,
    width: 20,
    backgroundColor: props.handlerColor || 'blue',
  },
  handlerTopLeft: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderRightWidth: 20,
    borderTopWidth: 20,
    borderRightColor: 'transparent',
    borderTopColor: props.handlerColor
  },
  handlerTopRight: {
    transform: [
      { rotate: '90deg' }
    ]
  },
  handlerBottomLeft: {
    transform: [
      { rotate: '270deg' }
    ]
  },
  handlerBottomRight: {
    transform: [
      { rotate: '180deg' }
    ]
  },
  activeHandler: {
    borderRightWidth: 50,
    borderTopWidth: 50,
  },
  handlerRound: {},
  image: {
    width: getWidth(props),
    ...(!props.viewHeight ? { position: 'absolute' } : {}),
  },
  bottomButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'blue',
    width: 70,
    height: 70,
    borderRadius: 100,
  },
  handler: {
    height: TOUCHABLE_HEIGHT,
    width: TOUCHABLE_HEIGHT,
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  cropContainer: {
    position: 'absolute',
    left: 0,
    width: Dimensions.get('window').width,
    top: 0,
    paddingHorizontal: getHorizontalPadding(props),
  },
  polygon: {
    position: 'absolute',
    left: props.viewHeight ? getHorizontalPadding(props) : 0,
    top: 0,
  }
});

export default CustomCrop;
