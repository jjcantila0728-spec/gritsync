import React from 'react'
import { Tabs } from 'expo-router'
import { TabBar } from '@/components/TabBar'

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="docs" />
      <Tabs.Screen name="timeline" />
      <Tabs.Screen name="review" />
      <Tabs.Screen name="settings" />
    </Tabs>
  )
}
